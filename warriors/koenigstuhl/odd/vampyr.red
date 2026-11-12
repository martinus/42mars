;redcode-lp
;name Vampyr
;author Michal Janeczek
;       MAXPROCESSES == 8
;assert 1

      org   pGo

boot equ 1300
vStep equ   935 ; 21445
vFang equ   (vLoop + 0 - vStep)
vPass equ   (vLoop + 1 - 116*5)
vPit  equ   (vPass+vFang-vHit-(1*vStep)) ;vPit  equ   (vLoop + 0 + 39508)
vClr  equ   (vPass+vFang-vHit-(2*vStep)) ;vClr  equ   (vLoop + 0 + 400*5)

vLoop sub.f #vStep , vFang
      mov   vFang  , @vFang
vHit  mov   vHalt+5  , *vFang
      jmp   vLoop  , >vClr+1

vHalt jmp   #1     , 1

pGo
    mov   vJmp   , vFang+boot
msrc mov vHalt, vHalt+boot+5
       mov   #vPit+17-vClr, vClr+boot-8
vCDest spl   1      , vClr+3+boot
vPDest spl   1      , vPit+3+boot
       mov {msrc, <bptr
       mov   {pGo   , <vCDest
       mov   {pGo   , <vPDest

bptr      spl   2       , vLoop+boot+4
      jmp   *2      , }0
      jmp   @1      , }0
      dat   vClr+boot    , vLoop+2+boot
      dat   vLoop+1+boot , vLoop+boot
      dat   vLoop+3+boot , vLoop+2+boot
      dat   vLoop+1+boot , vLoop+boot

      mov vClr+3-vPit , >vClr-vPit-7
      spl   -1 , 1000
      jmp   -2 , 1000
      dat   0  , 0

      mov.x #vPit-vPass , vPass+1-vClr
      mov   2      , >-8
      jmp   -2     , {232-vClr
      dat   0      , 12

vJmp  jmp   @vPass-vHit-3*vStep , vHit+3*vStep-vFang

      end
