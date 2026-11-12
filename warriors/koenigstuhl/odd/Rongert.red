;redcode-94nop
;name Rongert
;author Roy van Rijn
;strategy Cousin of Ringert
;strategy Different boot, different launcher
;strategy More aggresive
;assert 1
 
for 5
dat 1,1 ;decoy
rof
 
       sStep equ 45
       iStep equ 267
 
sStart spl   #-sStep,  >sStep
       mov   >-sStep*2,1+sStep*2
       add   -2,       -1
       djn.f -2,       >sStart+sStep
 
bDist equ -203
iImp equ iMov+128
 
wGo    mov.i iMov,       iImp
wBoot  spl   1,          sStart
       mov.i >wBoot,     }bPtr
       mov.i >wBoot,     }bPtr
       spl   <bPtr,      {iImp+iStep*6
       spl   1,          {iImp+iStep*4
       spl   2,          {iImp+iStep*2
       djn.a >0,         #iImp
       djn.f @0,         #iImp+iStep*1
iMov   mov.i #iStep,   *0
bPtr   dat   sStart+bDist, sStart+bDist+2
 
end wGo
