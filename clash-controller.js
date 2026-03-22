const http = require('http');

const DEFAULT_CLASH_API_HOST = '127.0.0.1';
const DEFAULT_CLASH_API_PORT = 9090;
const DEFAULT_CLASH_API_SECRET = '';

class ClashController {
  constructor(options = {}) {
    this.host = options.host || process.env.CLASH_API_HOST || DEFAULT_CLASH_API_HOST;
    this.port = options.port || Number(process.env.CLASH_API_PORT) || DEFAULT_CLASH_API_PORT;
    this.secret = options.secret || process.env.CLASH_API_SECRET || DEFAULT_CLASH_API_SECRET;
    this.nodes = [];
    this.currentNode = null;
  }

  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _request(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (this.secret) {
        options.headers['Authorization'] = `Bearer ${this.secret}`;
      }

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const statusCode = res.statusCode || 0;
          let parsedBody = body;
          try {
            parsedBody = JSON.parse(body);
          } catch (e) {
            // Keep plain text body when response is not JSON.
          }

          if (statusCode < 200 || statusCode >= 300) {
            const preview = String(body).slice(0, 200);
            reject(new Error(`Clash API ${method} ${path} failed (${statusCode}): ${preview}`));
            return;
          }

          resolve(parsedBody);
        });
      });

      req.setTimeout(10000, () => {
        req.destroy(new Error(`Clash API ${method} ${path} timeout`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async getProxies() {
    try {
      const data = await this._request('/proxies');
      return data.proxies || {};
    } catch (err) {
      console.error('Failed to get proxies:', err.message);
      return {};
    }
  }

  async getProxyGroups() {
    const proxies = await this.getProxies();
    const groups = [];

    for (const [name, proxy] of Object.entries(proxies)) {
      if (proxy.type === 'Selector' && proxy.all && proxy.all.length > 0) {
        groups.push({
          name,
          type: proxy.type,
          now: proxy.now,
          all: proxy.all
        });
      }
    }

    return groups;
  }

  async getMainSelectorGroup() {
    const groups = await this.getProxyGroups();
    
    // Priority: find group with "选择节点" in name
    let mainGroup = groups.find(g => g.name.includes('选择节点'));
    
    // Fallback: find group named "Proxy" or "PROXY"
    if (!mainGroup) {
      mainGroup = groups.find(g => g.name.toLowerCase() === 'proxy');
    }
    
    // Fallback: use first group that is not GLOBAL
    if (!mainGroup) {
      mainGroup = groups.find(g => g.name !== 'GLOBAL');
    }
    
    // Last resort: use first group
    if (!mainGroup && groups.length > 0) {
      mainGroup = groups[0];
    }
    
    return mainGroup;
  }

  async switchToNextNode(groupName = null) {
    try {
      const allProxies = await this.getProxies();
      const groups = await this.getProxyGroups();

      console.log(`  [Debug] Found ${groups.length} proxy groups`);
      if (groups.length > 0) {
        console.log(`  [Debug] Groups: ${groups.map(g => g.name).join(', ')}`);
      }

      if (groups.length === 0) {
        console.log('No proxy groups found');
        return false;
      }

      let targetGroup;
      if (groupName) {
        targetGroup = groups.find(g => g.name === groupName);
        if (!targetGroup) {
          console.log(`Proxy group "${groupName}" not found`);
          console.log(`  Available groups: ${groups.map(g => g.name).join(', ')}`);
          return false;
        }
      } else {
        targetGroup = await this.getMainSelectorGroup();
        if (!targetGroup) {
          console.log('No suitable proxy group found');
          return false;
        }
      }

      console.log(`  [Debug] Target group: ${targetGroup.name}, current node: ${targetGroup.now}`);
      console.log(`  [Debug] Total nodes in group: ${targetGroup.all.length}`);

      // Filter: only actual nodes (not Selectors), containing '|'
      const availableNodes = targetGroup.all.filter(nodeName => {
        const proxy = allProxies[nodeName];
        if (!proxy) return false;
        
        const isNotSelector = proxy.type !== 'Selector' && 
               proxy.type !== 'URLTest' && 
               proxy.type !== 'LoadBalance' &&
               proxy.type !== 'Fallback';
        const hasPipe = nodeName.includes('|');
        
        if (isNotSelector && hasPipe) {
          console.log(`    [Debug] Available node: ${nodeName} (type: ${proxy.type})`);
        }
        
        return isNotSelector && hasPipe;
      });

      if (availableNodes.length === 0) {
        console.log('No available nodes with "|" in name (excluding Selectors)');
        console.log('  [Debug] First 10 nodes in group:');
        targetGroup.all.slice(0, 10).forEach(n => {
          const p = allProxies[n];
          console.log(`    ${n} - type: ${p?.type || 'unknown'}`);
        });
        return false;
      }

      console.log(`  [Debug] Found ${availableNodes.length} available nodes`);

      // Sync with Clash's current selected node before picking next.
      this.currentNode = targetGroup.now || this.currentNode;

      // Randomly select a node different from current
      let nextNode;
      if (availableNodes.length === 1) {
        nextNode = availableNodes[0];
      } else {
        do {
          const randomIndex = this._randomBetween(0, availableNodes.length - 1);
          nextNode = availableNodes[randomIndex];
        } while (nextNode === this.currentNode);
      }
      
      this.currentNode = nextNode;

      console.log(`  [Debug] Switching to: ${nextNode}`);
      
      const result = await this._request(`/proxies/${encodeURIComponent(targetGroup.name)}`, 'PUT', {
        name: nextNode
      });

      console.log(`  [Debug] API response: ${JSON.stringify(result).slice(0, 100)}`);
      console.log(`Randomly switched to node: ${nextNode} (group: ${targetGroup.name})`);
      return true;
    } catch (err) {
      console.error('Failed to switch node:', err.message);
      return false;
    }
  }

  async getCurrentNode(groupName = null) {
    try {
      const groups = await this.getProxyGroups();

      if (groups.length === 0) {
        return null;
      }

      const targetGroup = groupName
        ? groups.find(g => g.name === groupName)
        : groups[0];

      return targetGroup ? targetGroup.now : null;
    } catch (err) {
      console.error('Failed to get current node:', err.message);
      return null;
    }
  }

  async testConnection() {
    try {
      await this._request('/version');
      return true;
    } catch (err) {
      return false;
    }
  }
}

module.exports = { ClashController };
