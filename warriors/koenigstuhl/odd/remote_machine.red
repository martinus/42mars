;redcode
;name Remote Machine
;author Darek Leniowski
;assert 1
ORG GO
GO: MOV.I 8,*7
MOV.I 5,{6
SPL *5
ADD.A #-270, 3
ADD.A #271,  3
JMP -5
MOV.I -546, 9
DAT 548,0
DJN.F -1,-1