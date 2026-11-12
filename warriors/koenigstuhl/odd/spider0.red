;redcode
;name Spider
;author Darek Leniowski
;assert 1
org GO

GO: SPL 10
MOV     0,   -50;copy
MOV.I }-1, >-1
SLT.A #15,  -2
JMP    -2
SPL    -54
ADD.AB   #-236,  -5
ADD.A    #-220,  -2
MOV.A    #  0,  -7
SPL -7
SPL 4 ;3imps
SPL 3
JMP 2
NOP 0
MOV 0,1
MOV 0,1
MOV 0,1