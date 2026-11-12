;redcode
;name Leap Toad
;Tournament: ICWST'90
;Standard: CWS'88
;author Matthew Skala
;assert 1

KILLPTR   DAT             #0
KILL      MOV  KILLPTR,   <KILLPTR
          DJN  KILL,      #1024
          MOV  #1024,     -1
START     SPL  KILL
          MOV  0,         5
          MOV  0,         5
          MOV  0,         5
          MOV  0,         5
          MOV  0,         5

          END       START
