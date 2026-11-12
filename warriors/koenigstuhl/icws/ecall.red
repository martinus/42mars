;redcode
;name E-Call
;author CatFace
;strategy 1st place in Japanese Preliminary '87
;strategy ICWST'87 semi-finalist
;assert 1
MAIN    MOV     MIS    ,@P
        ADD     #8     ,P
        MOV     MISM   ,MT
        JMP     MAIN
MIS     JMP     -8
COUNT   DAT     #64
CE      DAT     #-30
P       DAT     #13
MISM    JMP     -3
AD      SPL     0
        DJN     MT     ,COUNT   ; was DJN POOL ,COUNT (missing label)
        JMP     CLOSE
MT      JMP     AD
CLOSE   MOV     AD     ,@C
        CMP     #30    ,C
        DJN     MT     ,C
        MOV     #-30   ,C
        JMP     CH
DG      JMP     -8
CH      SPL     AD
        JMP     MT              ; was JMP POOL (missing label)
C       DAT     #-30
        END     MAIN
