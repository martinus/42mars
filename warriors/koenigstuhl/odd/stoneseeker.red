;redcode
;name Stone seeker
;author Sascha Zapf
;assert CORESIZE==8000

step    EQU             244
fscan   EQU             91
gate EQU        498

loop    add.ab  #step, start
start   jmz             -1, fscan
                jmz             -2,<start
                mov.i   imp,@start
                jmp             bomb+1
for     20
        dat 0,0
rof
bomb    dat.f   #-20,#30
                mov.i   bomb,>start
                jmp             -1, <-gate
imp             mov.i   0,1
                end start
