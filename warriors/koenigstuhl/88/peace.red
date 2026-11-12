;redcode
;name Peace
;author Mr. Jones
;strategy Quick-Strike the Enemy's Code.
;strategy When Main Program is Destroyed, 
;strategy ...Then Try to Tie the Game.
;assert 1

tar	equ	6
dst	equ	-100
a       spl     b,     <-1010
	mov	tar,dst
	mov	tar,dst
	mov	tar,dst
	mov	tar,dst
	spl	dst-tar+2,<1070    ;this is Night
	jmp	dst-tar+1,<1080
        spl     0,      <-1001
        mov     <21,    1+2234
        sub     1,      -1
        djn     -2,     <-2234
IMP0    EQU IMP			   ;this is Spiral
IMP1    EQU IMP+2667
IMP2    EQU IMP+2667+2667
b       SPL 16, <3708
        SPL 8, <1935
        SPL 4, <1814
        SPL 2, <2011
        JMP IMP0, <7370
        JMP IMP1, <6013
        SPL 2, <5812
        JMP IMP2, <4811
        JMP IMP0+1, <3910
        SPL 4, <7517
        SPL 2, <4916
        JMP IMP1+1, <2215
        JMP IMP2+1, <7214
        SPL 2, <7013
        JMP IMP0+2, <6712
        JMP IMP1+2, <6511
        SPL 8, <6110
        SPL 4, <5617
        SPL 2, <5216
        JMP IMP2+2, <3511
        JMP IMP0+3, <1910
        SPL 2, <2417
        JMP IMP1+3, <3316
        JMP IMP2+3, <4603
        SPL 4, <3602
        SPL 2, <4161
        JMP IMP0+4, <3104
        JMP IMP1+4, <2903
        SPL 2, <2172
        JMP IMP2+4, <1517
        JMP IMP0+5, <1011
IMP     MOV 0, 2667
end     a
