;redcode
;name slave for Tumzi
;author Zul Nadzri
;assert 1
;strategy For Round 13 tournament
;strategy I propose a rule not to use master-slave warriors.
;strategy However, since everybody opposed to this proposal, I am using one.
;strategy It is legal, why don't manipulate the loop hole?

PIN 103

topper	stp #44, #33
		for 10
		stp #44, #33
		rof
		jmp topper

		for 10
		dat 0,0
		rof

start2	stp #2, #2
pine		ldp.ab #5, #0
		seq.b pine, #5
		dat 0,0

blunt		spl two
		spl topper
		spl bottom

one		jmz 0, -30	
one1		mov safe, @one
		for 5
		mov safe, <one
		rof
		mov b, <one
		mov a, <one
		mov scan1, <one
		mov safe, <one
		add #1, one
		jmp @one

two		jmz 0, 30
two1		mov safe, @two
		for 3
		mov safe, >two
		rof
		mov scan2, >two
		mov a, >two
		mov b, >two
		sub #3, two
		jmp @two
	
safe		jmp 0,0
scan1		jmz 0, 6
a		mov safe, @-1
b		jmp @-2
scan2		jmz 0, -2

		for 10
		dat 0,0
		rof

bottom	stp #44, #33
		for 10
		stp #44, #33
		rof
		jmp bottom

end start2
