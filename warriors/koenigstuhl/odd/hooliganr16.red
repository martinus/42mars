;redcode-cc
;name 	Hooligan-R16
;author G.Labarga
;assert CORESIZE==8000
;strategy	Blur-style scanner

	m equ mov

	org 3

	m *1,>4000
	m 5,>-1
	seq }156,}152
	m.b @1,@-2
	sub.f 2,-2
	jmn -4,-3
	spl #-152,-152
	m 2,>-9
	djn.f -1,>-10
	dat <2667,13



