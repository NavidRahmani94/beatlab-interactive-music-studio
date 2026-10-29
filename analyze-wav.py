import wave, numpy as np, glob, os, sys
d=sys.argv[1]
def load(f):
    w=wave.open(f); n=w.getnframes(); sr=w.getframerate(); ch=w.getnchannels()
    a=np.frombuffer(w.readframes(n),dtype='<i2').astype(float)/32768
    return a.reshape(-1,ch), sr
def db(x): return 20*np.log10(max(x,1e-9))
for f in ['song.wav','groove_pattern.wav','solo_ambient.wav','solo_arp.wav','solo_melody.wav']:
    a,sr=load(os.path.join(d,f)); m=a.mean(1)
    print(f, f'{len(m)/sr:.1f}s peak {db(abs(a).max()):.1f} dBFS rms {db(np.sqrt((m**2).mean())):.1f}')
a,sr=load(os.path.join(d,'song.wav')); m=a.mean(1)
bar=int(sr*(0.05+0)) ; barlen=sr*60/96*4
print('song per-bar RMS dB (intro,intro,groove x4,breakdown x2):',[round(db(np.sqrt((m[int(0.05*sr+i*barlen):int(0.05*sr+(i+1)*barlen)]**2).mean())),1) for i in range(8)])
# ambient: sustained energy across the 8 bars (min/max of per-half-bar rms)
a,sr=load(os.path.join(d,'solo_ambient.wav')); m=a.mean(1)
seg=[db(np.sqrt((m[int(0.05*sr+i*barlen/2):int(0.05*sr+(i+1)*barlen/2)]**2).mean())) for i in range(16)]
print('ambient half-bar rms dB:',[round(x,1) for x in seg])
# arp: count onsets in first intro bar
a,sr=load(os.path.join(d,'solo_arp.wav')); m=a.mean(1)
hop=int(sr*0.005); env=np.array([np.sqrt((m[i:i+hop]**2).mean()) for i in range(0,len(m)-hop,hop)])
b0=int((0.05)/0.005); b1=int((0.05+barlen/sr)/0.005); e=env[b0:b1]
d_=np.diff(e); thr=e.max()*0.05
ons=[i for i in range(1,len(d_)) if d_[i-1]<=thr*0.3 and d_[i]>thr and e[i+1]>e[i-1]]
# dedupe within 60ms
res=[]
for i in ons:
    if not res or i-res[-1]>=12: res.append(i)
print('arp onsets in first bar (expect 16 at 1/16):',len(res))
print('instruments (E4 x8 steps, vel100, no fx): peak dBFS / rms dBFS')
for f in sorted(glob.glob(os.path.join(d,'inst_*.wav'))):
    a,sr=load(f); m=a.mean(1); seg=m[:int(sr*(0.05+60/120*2))]
    print(f'  {os.path.basename(f)[5:-4]:14s} peak {db(abs(a).max()):6.1f}  rms {db(np.sqrt((seg**2).mean())):6.1f}')
