let term;
let currentWs;
let metaWs;
let fitAddon;
let currentSessionId = null;

function initTerminal() {
    if (term) return; 

    term = new Terminal({
        cursorBlink: true,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14,
        letterSpacing: 0,
        lineHeight: 1.2,
        theme: {
            background: '#000000',
            foreground: '#e0e6ed',
            cursor: '#7c4dff',
            selectionBackground: 'rgba(124, 77, 255, 0.3)',
            black: '#1e293b',
            red: '#ef4444',
            green: '#10b981',
            yellow: '#f59e0b',
            blue: '#3b82f6',
            magenta: '#8b5cf6',
            cyan: '#06b6d4',
            white: '#f8fafc'
        },
        allowProposedApi: true
    });
    
    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(document.getElementById('terminal-container'));
    fitAddon.fit();
    
    window.addEventListener('resize', () => {
        fitAddon.fit();
    });

    // Handle direct terminal typing
    term.onData(data => {
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(data);
        }
    });

    // Handle the separate input box
    const inputField = document.getElementById('terminal-input');
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && inputField.value) {
            if (currentWs && currentWs.readyState === WebSocket.OPEN) {
                currentWs.send(inputField.value + '\r');
                inputField.value = '';
            }
        }
    });
}

function connectMeta() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/meta`;
    
    metaWs = new WebSocket(wsUrl);
    
    metaWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'sessions') {
            updateSessionList(msg.data);
        }
    };
    
    metaWs.onclose = () => {
        console.log('Meta WS closed, retrying in 2s...');
        setTimeout(connectMeta, 2000);
    };
}

function updateSessionList(sessions) {
    const list = document.getElementById('session-list');
    list.innerHTML = '';
    
    if (sessions.length === 0) {
        list.innerHTML = '<li style="color: var(--text-secondary); font-size: 13px; padding: 10px;">No active sessions</li>';
        return;
    }

    sessions.forEach(session => {
        const li = document.createElement('li');
        li.className = `session-item ${currentSessionId === session.id ? 'active' : ''}`;
        
        const statusClass = session.isRunning ? 'running' : 'stopped';
        const argsPrefix = session.args.length > 0 ? session.args.join(' ') : '';
        
        li.innerHTML = `
            <span class="session-name">${session.command} ${argsPrefix}</span>
            <div class="session-meta">
                <span class="status-indicator ${statusClass}"></span>
                ${session.isRunning ? 'Running' : `Exited (${session.exitCode})`}
                <span>• PID: ${session.pid}</span>
            </div>
        `;
        
        li.onclick = () => connectToSession(session);
        list.appendChild(li);
        
        // Auto-update UI if current session status changed
        if (currentSessionId === session.id) {
            document.getElementById('current-session-title').innerText = `${session.command} ${argsPrefix}`.trim();
        }
    });
}

function connectToSession(session) {
    if (currentSessionId === session.id) return;
    
    currentSessionId = session.id;
    document.getElementById('current-session-title').innerText = `${session.command} ${session.args.join(' ')}`.trim();
    document.getElementById('current-session-info').innerText = `ID: ${session.id} | CWD: ${session.cwd}`;
    document.getElementById('session-actions').style.display = 'block';

    // Highlight in list
    document.querySelectorAll('.session-item').forEach(item => {
        item.classList.toggle('active', item.innerText.includes(session.command));
    });

    initTerminal();
    term.clear();

    if (currentWs) {
        currentWs.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${session.id}`;
    
    currentWs = new WebSocket(wsUrl);
    
    currentWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
            term.write(msg.data);
        } else if (msg.type === 'metadata') {
            console.log('Session metadata:', msg.data);
        }
    };
    
    currentWs.onclose = () => {
        term.write('\r\n\x1b[31m[Session Disconnected]\x1b[0m\r\n');
    };
}

// Initial start
connectMeta();
