;redcode-odd
;name Unfortunate Delay
;author Lukasz Grabun
;assert 1
;strategy decoy maker -> one shot scanner
;strategy copy of Monowire, with a slight polish

off     EQU     (8*14)
step    EQU     16

one     ADD.F   inc     , @inc+2
ptr     SNE.I   off     , off-8
        JMP.B   one     , 0
inc     SPL.B   #step   , #step
        MOV.I   @2      , >ptr
        MOV.I   @1      , >ptr
        DJN.F   -2      , {2
        DAT.F   -100    , 7
        SPL.B   #-100   , 8

decoy   EQU     (one-1993)

for 80
dat 0,0
rof

d       MOV.I   <decoy+0, {decoy+2
        MOV.I   <decoy+3, {decoy+5
        MOV.I   <decoy+6, {decoy+8
        DJN.F   one     , {decoy+10

        end    d
