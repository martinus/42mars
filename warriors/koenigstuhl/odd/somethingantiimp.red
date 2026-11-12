;redcode
;name Something...anti-imp?
;assert 1
;author Roy van Rijn

;constants for the coreclear paper
cstep1 equ 3137
nstep1 equ 705
tstep1 equ 1601

pAw1   equ 5567
pAw2   equ 472

pGo     spl     1       , <2365
        spl     1       , >3662
        spl     1       , <2566

      mov    {cp,    {pBo1
pBo1  spl    pEnd+pAw1,{5747

      mov    {pEnd,    {pBo2
pBo2  jmp    pEnd+pAw2,{4584

cp    spl    @pEnd,  <tstep1
      mov.i  }cp,    >cp
nothA spl    @nothA, <cstep1
      mov.i  }nothA, >nothA
      mov.i  bomb,   <641
      mov    {nothA, {nothB
nothB djn.f  nstep1, >4228
bomb  dat    <5334,  <2667
pEnd  dat    0,      0


end pGo
