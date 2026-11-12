;redcode-lp
;name Harmony 2520
;author Lukasz Grabun
;strategy scanner
;assert 1

step equ 3056
gate equ (ptr-4)

ptr JMP.B spb , -2991
atk MOV.I spb , >ptr
scan SEQ.I }step , }step+7
MOV.AB scan , ptr
ADD.F spb , scan
JMN.A atk , scan
spb SPL.B #step , #step
MOV.I bmb , >gate
DJN.F -1 , >gate
bmb DAT.F <2667 , 2-gate
end scan
