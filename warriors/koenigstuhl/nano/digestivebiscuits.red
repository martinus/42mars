;redcode-nano
;assert 1
;author hwm
;name digestive biscuits and tea
;strategy imp/clear
;strategy a variation on proceed as normal
;strategy with some dats through the core

step equ 39
q1 equ -12

boot 	spl.x #step+1, {q1+1
 	mov.i >q1, {boot
 	mov.i {boot, {q1-1
 	spl.f {2, >20
 	mov.i #-step, }1
end

