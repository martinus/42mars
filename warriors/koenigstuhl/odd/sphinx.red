;redcode
;name Sphinx
;author Sascha Zapf
;strategy 100% Impgate + Anti Imp Backward Clear + Anti DJN-Stream Decoy
;assert CORESIZE==8000

gatepos EQU start-12

start   spl 1          , <gatepos
        spl 1          , <gatepos
loop    mov.i  start-1 , <gatepos
        jmp    loop    , <gatepos

for 16
dat		1,1
rof
		end start
