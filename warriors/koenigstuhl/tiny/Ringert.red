;redcode-94nop
;name Ringert
;author Roy van Rijn
;strategy Stone/Imp, based on Snowstorm
;strategy Stone has different step size
;strategy Funky new imp launcher from scratch
;strategy 7 lines, 8 process ring in 15 steps
;assert 1
 
       sStep equ 45
       iStep equ 267
 
sStart spl   #-sStep,  >sStep
       mov   >-sStep*2,1+sStep*2
       add   -2,       -1
       djn.f -2,       >sStart+sStep
 
for 9
dat 0,0
rof
 
iTable equ   iImp+1
 
wGo    spl   sStart,   iImp+(iStep*7) + 1
       spl   1,        iImp+(iStep*6) + 1
       spl   1,        iImp+(iStep*5) + 1
       spl   1,        iImp+(iStep*4) + 1
iPtr   djn.f <iTable,  #iImp+(iStep*3)+ 1 + iTable
       dat   0,        iImp+(iStep*2) + 1
iImp   mov.i #1,       iImp+(iStep*1) + 1
 
; Line below is:
;  iTable dat   0,        iImp+(iStep*0)+1
; Which is:
;  dat 0,0
; So can be ommitted
 
end wGo
