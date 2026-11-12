;redcode
;name Bitstorm
;author Steve Bonner
;assert CORESIZE==8192 
NIMBUS   DAT               #801
START    ADD     #200,   NIMBUS
         MOV    STONE,  @NIMBUS
         MOV     HAIL,  <0        ; original: mov hail, <  
         SPL            @NIMBUS
         JMP    START
HAIL     ADD    #1691,       -1
STONE    DJN       -1,      @-2
         END    START


