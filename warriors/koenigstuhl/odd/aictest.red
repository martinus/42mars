;redcode
;name aictest
;author Nenad Tomasev
;assert 1

	org clr
gate	dat 0, 100
	dat -100, 0
	dat 0, 0
	dat 0, 0
	dat 0, 0
	dat 14, <2667
	mov.i #14, {1
clr	spl #12, 1
	mov clr, }gate
	mov clr, }gate
	djn.a -2, {dc
dc	dat -100, 0
	end

