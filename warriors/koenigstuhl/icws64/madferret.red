;redcode
;name MAD Ferret
;author Mark A. Durham
;assert CORESIZE==8192 
START       CMP     < HERE ,  < THERE
            MOV       TRAP ,  @ THERE
            CMP     < HERE ,  < THERE
HERE        MOV       TRAP ,    START
            JMN       START,    THERE
LOOP        MOV       KILL ,  < KILL
            DJN       LOOP ,  < KILL
TRAP        SPL       TRAP
KILL        DAT                #LOOP
THERE       DAT                #4096
            END       START



