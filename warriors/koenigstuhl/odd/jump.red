;redcode-94nop
;name Jump
;author P.Kline
;assert CORESIZE == CORESIZE
;strategy CIA-type bomber -> binary replicator

for CORESIZE==800
step   equ    24
count  equ    16
spwn1  equ    311
rof
for CORESIZE==8000
step   equ    24
count  equ    650
spwn1  equ    913
rof
for CORESIZE==55440
step   equ    24
count  equ    4500
spwn1  equ    (55440/4)+1147; 891
rof

flag   equ    (loop-12)

spy    dat    {flag-step*count  ,{(step*count)
       dat    0             ,0
loop   add.x  incr          ,spy
       mov    spy           ,*spy
       mov    spy           ,@spy
       jmz.f  loop          ,flag
;brea
       spl    rep           ,-rep
       mov    }0            ,}0
   for 3
       dat    0             ,0
   rof
rep    spl    }1            ,{0
       spl    0             ,0
spwn   spl    @0            ,}spwn1
       mov    }spwn         ,>spwn
       mov    {spwn         ,{1
incr   djn.f  -step         ,{step

       dat    0             ,0

       end    loop+1
