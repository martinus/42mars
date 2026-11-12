;redcode-odd
;author Lukasz Grabun
;name stone/paper
;strategy Simple. Pixie and Disincentive.
;strategy Combined somewhen in the past.
;assert CORESIZE==8000

orig z  for 0
        rof

hit0    equ    1369
hit1    equ    543
dst0    equ    4187
dst1    equ    3065
dst2    equ    1282

soff    equ    (4519+orig)

paper   SPL.B  2      , 0
        SPL.B  2      , 0
        SPL.B  1      , }0
        SPL.B  1      , 0

silk0   SPL.B  @0     , <dst0
        MOV.I  }silk0 , >silk0
silk1   SPL.B  @0     , <dst1
        MOV.I  }silk1 , >silk1
        MOV.I  bomb   , >hit0
        MOV.I  bomb   , >hit1
        MOV.I  {silk1 , <silk2
silk2   DJN.F  @0     , <dst2
bomb    DAT.F  >2667  , >5334

for 70
dat 0,0
rof

step    equ    107
hit     equ    -116
hop     equ    (6916+1)
gate    equ    (hop+smov-1)

stone   SPL.B  #0    , #0
ptr     MOV.I  sbmb+6, {hit
smov    MOV.I  sbmb+6, @ptr
        SUB    #step , ptr
loop    DJN.F  ptr   , <5500
sbmb    DAT.F  <hop  , >1


boot    MOV.I  sbmb  , soff+6
        MOV.I  stone , soff-6
src     SPL  }2    , loop+1
dst     SPL  *1    , soff
        SPL  0     , 0
        MOV.I  <src  , <dst
        djn @boot+1, #5
        jmp     paper
        end    boot
