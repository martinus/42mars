;redcode
;name MicroVamp 1.0
;author Eric J. Schwertfeger
;strategy Very small vampire.
;strategy Not fancy, Need to see how
;strategy well it does first
;strategy Submitted: @date@
;assert 1

        JMP     PIT
MDSTART MOV     JMPBOMB,<BOMB
MDLOOP  DJN     MDSTART,BOMB
CLRLOOP MOV     WHERE,<WHERE
        DJN     CLRLOOP,WHERE
        JMP     0
TEMP    JMN     CLRLOOP+1,WHERE+2
PIT     MOV     TEMP,TEMP-2
        MOV     JMPBOMB+2,JMPBOMB
PITLOOP MOV     WHERE,<WHERE
        MOV     WHERE,<WHERE
        SPL     0
        JMP     PITLOOP
WHERE   DAT     #0,#MDSTART-3
JMPBOMB JMP     2
BOMB    DAT     #0,#MDSTART-2

        END     MDSTART

