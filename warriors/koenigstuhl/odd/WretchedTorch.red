;redcode
;name WretchedTorch
;author P.Kline
;assert 1 || CORESIZE == 800
;strategy tiny hill torch
 
count    equ   (24)
step     equ   (648)
bsep     equ   (15)
 
gate     dat    0,0
     for 2
         dat    0,0
     rof
sp       spl    #-bsep     ,1-bsep
in       add.ab #step      ,1
         mov    sm         ,*tgt-(step*count)
         mov    sp         ,@-1 
tgt      jmz    in         ,#0  
         mov    wip        ,>gate
         djn.b  -1         ,>gate
wip      dat    0          ,2-gate
     for 2
         dat    0,0
     rof
sm       mov    bsep       ,>bsep  
         end    sp
