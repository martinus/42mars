;redcode-tour
;name ln(8192)=9.01091
;author John Metcalf
;strategy stone/imp
;       CORESIZE==8192
;assert 1

     sStep equ 3598
     iStep equ 3277
     sDist equ (pGo+2555)
     iDist equ (sDist+50+iStep)

sInc:spl   #-sStep,  >sStep
sPtr:mov   >-sStep*2,1+sStep*2
     add   sInc,     sPtr
     djn.f sPtr,     >sInc+sStep

imp: mov.i #iStep,   *0

pGo: mov   imp,      *iBoo
     spl   1,        {-790
     spl   1,        {-780
     mov   {pGo,     {sBoo
sBoo:djn   sDist+4,  #1
     spl   1,        {-770
     spl   1,        {-760
     spl   1,        {-750
     spl   1,        {-740
     spl   2,        {-730
iBoo:jmp   iDist,    <iDist-50
     add.f #iStep,   iBoo
     dat   <0,       <iDist+iStep-50
     end   pGo
