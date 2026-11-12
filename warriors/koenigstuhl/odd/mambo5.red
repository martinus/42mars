;redcode
;name Mambo #5
;author LAchi
;strategy Oneshot
;assert 1

s1
	add.f inc, dest

dest
	sne.i <16, <10
	jmp s1, <-20
	mov.a #bomb-dest, dest

inc
bomb
	spl #8, #8
	mov *dest, @dest
	jmp -1, >dest

	end dest

