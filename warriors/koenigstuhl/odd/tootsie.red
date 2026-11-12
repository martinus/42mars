;redcode-94m
;name tootsie
;author P.Kline
;strategy mouse, core-wipe, anti-vamp
;assert 1
; KOFACOTO 2

avp     equ    (av-1290)
t2      dat    #0      ,#mend
 
tStart  mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
        mov    <t2     ,<t3
t3      spl    @0      ,4900

m1      add    #mend   ,0
        add    #120    ,a1
m2      mov    <m1     ,<a1
        mov    <m1     ,<a1
av      add    <avp    ,av2
        mov    #2      ,av2
av2     add    #0      ,@0
        sub    av2     ,av2
        mov    avp-2   ,<avp+5
        jmn    m2      ,m1
        
a1      spl    m1      ,m1+2303
        jmz    @a1     ,m1
        mov    2       ,<0
        djn    -1      ,-1
mend    dat    #0      ,#0
       end    tStart 
