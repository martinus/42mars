;redcode-RF19
;name Plaid Vamp
;author Chip Wendell
;strategy Gate + active vamp -> clear
;assert 1

       org    start
gate   nop    0,       4000
prison mov    vbomb,   <vptr
       jmp    -1,      }vbomb

vbomb  jmp    prison+1-gate, gate-vptr
dbomb  dat    0,       stone-dptr

start  spl    prison

;This process needs to pause one cycle on startup
; so that the vbomber fills in the hole in the gate
       mov    #4000,   gate

;This type of gate scores better than the 
; djn or jmz kind, which can be overwhelmed by 
; multiple imps (which this vamp produces)
keeper nop    <gate-1, <gate-2
       nop    <gate-1, <gate-2
       nop    <gate-1, <gate-2
       nop    <gate-1, <gate-3
       djn    keeper,  gate
       jmz.a  keeper-1, vptr    ;Falls through after
stone  mov    dbomb,   <dptr    ; all of core is vamped
       jmp    -1
dptr   dat    0,       stone
vptr   dat    0,       gate

for 3
       dat    1,       1        ;Imp-gate protection
rof
	end
