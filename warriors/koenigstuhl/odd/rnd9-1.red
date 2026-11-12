;redcode
;name rnd9-259504
;author Will Varfar
;assert 1


	ORG START
	dat.f  >   -1 , >    1
	nop.f  *   -1 , $    1
	mov.i  <    0 , {   -1
START	jmz.b  *   -1 , @    1
	sne.ba *   -1 , >    1
	mov.ba $    0 , *    0
	mov.i  #   -1 , $    1
	djn.b  $    1 , *   -1
	div.f  <   -1 , *    1
	div.ba *   -1 , #   -1
	add.ba *    0 , <    1
	jmn.f  >   -1 , }   -1
	sub.b  #   -1 , @    0
	mod.f  $    0 , *    0
	sub.ba }    1 , <    1
	djn.f  }    1 , $   -1
	mod.ab <   -1 , #   -1
	dat.f  {    0 , #    0
	add.b  $    1 , *   -1
	mul.ba *    0 , >    0
	seq.b  <    0 , >    1
	seq.f  *    1 , *    0
	seq.ab <    1 , }    0
	mul.f  }   -1 , @    1
	mov.b  }    0 , #    0
	sne.x  {   -1 , <    0
	seq.x  @   -1 , @    1
	seq.i  *    1 , >    0
	mov.i  *    0 , $    1
	div.x  #    1 , {    1

