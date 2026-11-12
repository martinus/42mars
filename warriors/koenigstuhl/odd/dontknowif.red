;redcode-rf23
;name don't know if it works
;author John Metcalf
;strategy written in 5 minutes, untested
;assert 1

gate:dat 0,0

for 10
dat 0,0
rof

testa:jmz.f #0,gate
     nop <gate+1,<gate+2
     nop <gate+1,<gate+2
     nop <gate+1,<gate+2
     nop <gate+1,<gate+2
     jmp testa, <gate+1

for 50
dat 0,0
rof

start:mov imp,20000
     spl @start,<-20000
     jmp testa
imp:mov.i #1,1

end start
