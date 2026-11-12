;redcode-94
;assert 1
;name Marchetun2.0
;author David Castro
;strategy bombardero multihilo con trampas

ORG start
start:  SPL escuadron2
        SPL escuadron3
        SPL escuadron4
        JMP escuadron1

escuadron1:  ADD #15, puntero    
        MOV puntero, @puntero
        JMP escuadron1
puntero:  DAT #4, #0

escuadron2:  MOV @posicionEscaner, temp    
        JMZ temp, continua 
        MOV #88, @posicionEscaner      

continua:
        ADD #5, posicionEscaner
        JMP escuadron2

temp:   DAT #0, #0
posicionEscaner: DAT #3, #0

escuadron3:  ADD #7, escuadron
        MOV escuadron, @escuadron
        ADD #3, escuadron
        JMP escuadron3
escuadron:   DAT #1, #0

escuadron4:  MOV @-2, posicionTrampa
        ADD #2, posicionTrampa
        JMP escuadron4
posicionTrampa: DAT #66, #0

END start
