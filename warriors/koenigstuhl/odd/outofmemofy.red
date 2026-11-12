;redcode-RF19 
;name Out of Memory
;author Achille Astolfi
;assert 1

org start

start	djn.f  #0, <-10
	spl -1
	mov.i #1, 1