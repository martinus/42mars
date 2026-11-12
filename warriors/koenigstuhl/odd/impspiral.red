;redcode
;name Imp Spiral
;author Lukasz Adamowski
;strategy stolen ;]
;assert 1

ISTEP   EQU 2731

IMP:    MOV 0, ISTEP
LAUNCH: SPL 1
        SPL 1
        SPL 1
        SPL 2
SPREAD: JMP @0, IMP
        ADD #ISTEP, SPREAD

END     LAUNCH
