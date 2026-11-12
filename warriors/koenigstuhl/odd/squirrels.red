;redcode-tour
;name Squirrels!
;author John Metcalf
;strategy clear/imp
;       CORESIZE==8192
;assert 1

     iStep equ 3277
     cDist equ (pGo+2555)
     iDist equ (cDist+50+iStep)
     gate  equ (cLoo-7)

     spl   #0,       0
cLoo:mov   dBmb,     >gate
     djn.f cLoo,     >gate
dBmb:dat   <2731,    3-gate

imp: mov.i #0,       iStep

pGo: mov   imp,      *iBoo
     spl   1,        {-790
     spl   1,        {-780
     mov   {pGo,     {cBoo
cBoo:djn   cDist+4,  #1
     spl   1,        {-770
     spl   1,        {-760
     spl   1,        {-750
     spl   1,        {-740
     spl   2,        {-730
iBoo:jmp   iDist,    <iDist-50
     add.f #iStep,   iBoo
     dat   <0,       <iDist+iStep-50
     end   pGo
