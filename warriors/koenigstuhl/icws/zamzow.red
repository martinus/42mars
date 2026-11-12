;redcode
;name Zamzow
;author Joe P. Zamzow
;strategy ICWST'87 semi-finalist
;strategy 1c reverse scan, dat bomb
;assert 1
SAFETY  DAT     #0
        DAT     #0
        DAT     #0
        DAT     #0
        DAT     #0
        DAT     #0
START   JMZ     START  ,<SEEK
        CMP     FLAG   ,@SEEK
        JMP     KILL
        MOV     #-26   ,SEEK
        JMP     START
KILL    ADD     #6     ,SEEK
        MOV     BOMB   ,<SEEK
        MOV     BOMB   ,<SEEK
        MOV     BOMB   ,<SEEK
        MOV     BOMB   ,<SEEK
        MOV     BOMB   ,<SEEK
        MOV     BOMB   ,<SEEK
        MOV     BOMB   ,<SEEK
        DJN     START  ,COUNT
        MOV     SURVIVR,2007
        MOV     FLAG   ,2007
        SPL     2005
        JMP     START
COUNT   DAT     #150
SURVIVR JMP     0
BOMB    DAT     #0
SEEK    DAT     #-27
FLAG    DAT     #327
        END     START
