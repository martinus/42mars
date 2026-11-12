;redcode 
;name New Shears
;author W. Mintardjo
;strategy Developed from Color Shears
;assert CORESIZE==8000
step EQU 3315+1
init EQU step-1
data DAT <-33, <-34
main MOV hold, @3
     MOV snow, <2
     ADD #step, @-1
     JMN main, #init
snow SPL 0, <-32
     MOV data, <-2
hold JMP -1, <-34
     END main

