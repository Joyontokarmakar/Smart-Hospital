// Client-side mock Supabase driver for offline LAN mode
const getApiUrl = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//localhost:5000`;
  }
  if (window.location.port === '5173') {
    return `${protocol}//${hostname}:5000`;
  }
  return window.location.origin;
};

// WebSocket state
let socket: WebSocket | null = null;
const activeSubscriptions = new Map<string, Array<{ event: string; filter: any; callback: (payload: any) => void }>>();

const initWebSocket = () => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  
  const apiUrl = getApiUrl();
  const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';
  
  try {
    socket = new WebSocket(wsUrl);
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // data: { table: string, event: 'INSERT'|'UPDATE'|'DELETE', record: any, old_record?: any }
        
        for (const [chanName, listeners] of activeSubscriptions.entries()) {
          // Listeners are subscribed on table channels or headers
          // Match table name
          if (chanName.includes(data.table) || chanName.startsWith('header-notifications-')) {
            for (const listener of listeners) {
              if (listener.event === '*' || listener.event === data.event) {
                let match = true;
                
                // Match filter if provided
                if (listener.filter?.filter) {
                  const parts = listener.filter.filter.split('=eq.');
                  if (parts.length === 2) {
                    const col = parts[0];
                    const val = parts[1];
                    if (String(data.record[col]) !== String(val)) {
                      match = false;
                    }
                  }
                }
                
                if (match) {
                  listener.callback({
                    new: data.record,
                    old: data.old_record || null,
                    eventType: data.event
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    socket.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };
    
    socket.onerror = () => {
      socket?.close();
    };
  } catch (err) {
    console.error('Failed to create WebSocket connection:', err);
  }
};

class LocalQueryBuilder {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selectCols: string = '*';
  private countOption: string | null = null;
  private filters: Array<{ type: string; column: string; value: any }> = [];
  private orderCol: string | null = null;
  private orderDesc: boolean = false;
  private limitVal: number | null = null;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private payloadData: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.action = 'select';
    this.selectCols = columns;
    if (options?.count) {
      this.countOption = options.count;
    }
    return this;
  }

  insert(data: any | any[]) {
    this.action = 'insert';
    this.payloadData = data;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.payloadData = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }

  like(column: string, value: any) {
    this.filters.push({ type: 'like', column, value });
    return this;
  }

  ilike(column: string, value: any) {
    this.filters.push({ type: 'ilike', column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: 'in', column, value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderDesc = options?.ascending === false;
    return this;
  }

  limit(value: number) {
    this.limitVal = value;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  // Promise thenable implementation
  async then(resolve?: (value: any) => any, reject?: (reason: any) => any) {
    try {
      const response = await fetch(`${getApiUrl()}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hospital_session_token') || ''}`
        },
        body: JSON.stringify({
          action: this.action,
          table: this.table,
          select: this.selectCols,
          countOption: this.countOption,
          filters: this.filters,
          orderCol: this.orderCol,
          orderDesc: this.orderDesc,
          limitVal: this.limitVal,
          isSingle: this.isSingle,
          isMaybeSingle: this.isMaybeSingle,
          data: this.payloadData
        })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || 'Database request failed');
      }

      const result = {
        data: json.data,
        error: json.error,
        count: json.count
      };

      if (resolve) return resolve(result);
      return result;
    } catch (err: any) {
      const errorResult = {
        data: null,
        error: { message: err.message || 'Offline API not available' },
        count: 0
      };
      if (resolve) return resolve(errorResult);
      if (reject) return reject(err);
      return errorResult;
    }
  }
}

class MockChannel {
  private channelName: string;
  private listeners: Array<{ event: string; filter: any; callback: (payload: any) => void }> = [];

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(event: string, filter: any, callback: (payload: any) => void) {
    this.listeners.push({ event, filter, callback });
    return this;
  }

  subscribe() {
    initWebSocket();
    activeSubscriptions.set(this.channelName, this.listeners);
    
    return {
      unsubscribe: () => {
        activeSubscriptions.delete(this.channelName);
      }
    };
  }
}

export function createLocalClient() {
  // Listeners for auth changes
  const authListeners: Array<(event: string, session: any) => void> = [];

  const triggerAuthChange = (event: string, session: any) => {
    authListeners.forEach(cb => cb(event, session));
  };

  return {
    auth: {
      async getSession() {
        const token = localStorage.getItem('hospital_session_token');
        const userJson = localStorage.getItem('hospital_session_user');
        
        if (token && userJson) {
          try {
            const user = JSON.parse(userJson);
            const session = {
              access_token: token,
              user: user
            };
            return { data: { session }, error: null };
          } catch (e) {
            localStorage.removeItem('hospital_session_token');
            localStorage.removeItem('hospital_session_user');
          }
        }
        return { data: { session: null }, error: null };
      },

      onAuthStateChange(callback: (event: string, session: any) => void) {
        authListeners.push(callback);
        
        // Call immediately with current session
        this.getSession().then(({ data: { session } }) => {
          callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
        });

        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const idx = authListeners.indexOf(callback);
                if (idx !== -1) authListeners.splice(idx, 1);
              }
            }
          }
        };
      },

      async signInWithPassword({ email, password }: any) {
        try {
          const res = await fetch(`${getApiUrl()}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Login failed');

          localStorage.setItem('hospital_session_token', json.session.access_token);
          localStorage.setItem('hospital_session_user', JSON.stringify(json.session.user));
          
          triggerAuthChange('SIGNED_IN', json.session);
          return { data: { session: json.session, user: json.session.user }, error: null };
        } catch (err: any) {
          return { data: { session: null, user: null }, error: err };
        }
      },

      async signUp({ email, password, options }: any) {
        try {
          const full_name = options?.data?.full_name || 'Staff Member';
          const role = options?.data?.role || 'receptionist';
          
          const res = await fetch(`${getApiUrl()}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, full_name, role })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Registration failed');

          localStorage.setItem('hospital_session_token', json.session.access_token);
          localStorage.setItem('hospital_session_user', JSON.stringify(json.session.user));
          
          triggerAuthChange('SIGNED_IN', json.session);
          return { data: { session: json.session, user: json.session.user }, error: null };
        } catch (err: any) {
          return { data: { session: null, user: null }, error: err };
        }
      },

      async signOut() {
        localStorage.removeItem('hospital_session_token');
        localStorage.removeItem('hospital_session_user');
        triggerAuthChange('SIGNED_OUT', null);
        return { error: null };
      }
    },

    from(table: string) {
      return new LocalQueryBuilder(table);
    },

    channel(name: string) {
      return new MockChannel(name);
    },

    removeChannel(channel: any) {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    },

    storage: {
      from(bucket: string) {
        return {
          async upload(filePath: string, file: File) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('bucket', bucket);
            formData.append('filePath', filePath);
            
            try {
              const res = await fetch(`${getApiUrl()}/api/storage/upload`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('hospital_session_token') || ''}`
                },
                body: formData
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.message || 'Upload failed');
              return { data: json, error: null };
            } catch (err: any) {
              return { data: null, error: err };
            }
          },
          
          getPublicUrl(filePath: string) {
            return {
              data: {
                publicUrl: `${getApiUrl()}/api/storage/file/${bucket}/${filePath}`
              }
            };
          }
        };
      }
    }
  };
}
