;redcode
;name Probe 3
;author Eric J. Schwertfeger
;strategy  This is a test.  This is only a test :-)
;assert 1

START1  EQU     (MDSTART+2001)
START2  EQU     (MDSTART+4000)
START3  EQU     (MDSTART+6001)

MDSTART MOV     BOMB,<BOMB
MDLOOP  JMP     MDSTART,<BOMB
BOMB    DAT     #0,#-4
START   MOV     MDSTART,START1
        MOV     MDSTART,START2
        MOV     MDSTART,START3
        MOV     MDLOOP,START1+1
        MOV     MDLOOP,START2+1
        MOV     MDLOOP,START3+1
        MOV     BOMB,START1+2
        MOV     BOMB,START2+2
        MOV     BOMB,START3+2
        SPL     START1
        SPL     START2
        SPL     START3
        JMP     MDSTART
        END     START

