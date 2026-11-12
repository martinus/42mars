;redcode-nano
;name Candy In Ire
;author gnik
;assert CORESIZE==80

step EQU 27
magic EQU 7
org go
spl $imp+2*step, >75
mov.i #1, <go
go spl $-2, <42
spl $imp+step, <go
imp mov.i #magic, $step
