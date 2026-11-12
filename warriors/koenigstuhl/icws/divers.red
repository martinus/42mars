;redcode
;name Divers
;Tournament: ICWST'90
;Standard: CWS'88
;author Matthew Skala
;assert 1

DIVE      MOV   # 13,         LOOPCTR
LOOP      ADD   # 16,         PTR
ENTER     MOV     PTR,      @ PTR
          MOV     TRAP,     @ PTR
LOOPCTR   DJN     LOOP,     # 1
          SPL   @ PTR
          JMP     DIVE
PTR       DAT               # 1028
TRAP      JMP     0

          END     ENTER
