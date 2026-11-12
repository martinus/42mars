;redcode
;name rnd9-592779
;author Will Varfar
;assert 1


	ORG START
	mul.x  {    1 , {    0
	mov.ab >   -1 , }    0
	mod.x  <    1 , }    0
	seq.x  >   -1 , <    0
	mod.ba #    0 , <   -1
	mov.f  {    1 , @   -1
	mov.b  {   -1 , *   -1
	add.b  $   -1 , >   -1
	jmz.b  $    1 , #    1
	sne.ab }   -1 , @   -1
	mov.f  @    1 , {    0
	mul.b  >    1 , @   -1
	seq.f  #    1 , <    0
	mov.i  #    0 , $    1
	sne.x  {   -1 , >    0
	add.ba >    0 , *    0
	jmn.b  *   -1 , $   -1
	mov.i  #    0 , $    1
	djn.b  $   -1 , @    0
	mov.i  #    0 , $    1
	mov.ab $   -1 , }    1
	jmz.a  <   -1 , $   -1
START	sub.x  }    0 , >   -1
	jmz.a  {    0 , {    1
	spl.f  #    1 , <    0
	mov.b  *   -1 , $   -1
	mov.i  }    1 , >    1
	dat.f  $    0 , @    1
	add.b  {   -1 , >    0
	add.ab <    1 , *    0

