;redcode 94
;name Sauron's Eye
;author Jakub Kozisek
;strategy one-shot -> clear
;assert 1

gate1   equ     (gate-5)

	org	start

for 81
	dat     0,	0
rof

	dat     #-5,	100
gate    dat     #-5,	jump-gate1+5
ptr	spl     #-5,	jump+100

for 10
	dat     0,	0
rof

start	sne	>ptr,	>ptr
	jmz.f	start,	>ptr

clear   spl	#1,	#1
	mov.i	@jump,	>gate1
	mov.i	@jump,	>gate1
jump    djn.f   clear+1,{gate+1

