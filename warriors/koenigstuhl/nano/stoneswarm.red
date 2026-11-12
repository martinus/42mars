;redcode-nano
;name Stone Swarm
;author Blake Escritt
;strategy Multi-threaded stone bomber – defeats clear and paper warriors
;assert CORESIZE==80

ORG 0
SPL 1, 0        ; create a new process at next instruction
MOV bomb, >ptr  ; write a DAT bomb, then increment pointer
JMP -2          ; loop back to SPL (creates exponential growth)
bomb: DAT 0, 0  ; bomb to be placed
ptr:  DAT 5, 0  ; initial pointer avoids own code

