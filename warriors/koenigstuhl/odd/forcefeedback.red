;redcode-94
;name Force feedback
;author Michal Janeczek
;strategy KOFACOTO Round 1 entry
;strategy Search for white warrior's qscan code, then copy
;strategy a spiral clear just behind the booted warrior.
;strategy
;strategy I tried also a backtracker, but it had only 85% wins.
;assert 1

qStep equ   300                  ; useful variables
bDist equ   1404
iStep equ   1143

fDec  equ   (fInc-qStep)
fStep equ   1589

fInc  add.a #fStep   , fPtr      ; search for qscan
      jmz.f fInc     , *fPtr
      jmn.f #0       , {fPtr
      nop   {fInc-2  , }fPtr
      seq   fComp    , *fPtr     ; is first instruction a bomb?
      jmp   fInc     , {fInc-2

      add.a #bDist   , fPtr      ; yes, boot the clear
fCopy mov   <fPtr    , {fPtr
      djn   fCopy    , #5
fPtr  jmp   fBlur+7  , fSpl+1

fComp dat   <1       , 12        ; white warrior's qscan bomb

fClr  add.a #iStep+1 , fSpl      ; 7-pt spiral clear
      mov   @fClr    , {fSpl
      jmp   fClr     , {fClr-2
      dat   -5       , {1
fSpl  spl   #4-iStep , 3

      for   78
      dat   0        , 0
      rof

fBlur mov   {fDec    , {fDec+2   ; protection against qscan
      mov   {fDec+1  , {fDec+4
      mov   {fDec+5  , {fDec+7
      mov   {fDec+8  , {fDec+12
      mov   {fDec+9  , {fDec+14
      jmp   fInc+1   , {fDec+15

      end   fBlur

