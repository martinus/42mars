;redcode verbose
;assert 1
; CORESIZE == 55440
;name Cavilling Concocter
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   An evolving population playing KOTH.
;strategy -   Configured for the big hill.
spl.b  #     1, {     1
spl.ab #     1, <     1
mov.i  #    -1, >     1
spl.ab #     1, <     1
mov.i  #    -1, <     1
mov.i  #    -1, <     1
mov.b  *    -1, #     1
add.x  <     1, *     1
djn.b  $    -1, #    -1
djn.ab $    -1, #    -1
mov.i  >    -1, {     0
djn.i  #     1, {     0
jmn.i  {    -1, #     0
spl.b  $     1, #     1
nop.ba $     1, #     1
mov.b  #     1, #     1
nop.i  $     0, #    -1
mov.ab #    -1, <    -1
jmp.f  #     1, #     0
jmp.f  #     1, <     0
cmp.x  }     0, $     0
cmp.x  }    -1, #     1
mul.ba *     1, #     0
djn.ba #     0, #     0
slt.i  #     0, #     0
slt.i  }    -1, #     0
mov.a  #    -1, #    -1
cmp.ab #     0, {    -1
slt.i  >     0, #    -1
mul.i  #     0, #     0
djn.i  #     1, #    -1
mul.b  *     1, #     1
mov.i  $     0, #     1
mod.f  *     1, #     1
mov.i  *     0, @     0
slt.i  #     0, #     1
mov.ab #    -1, #     1
mov.i  $     1, #     1
djn.ab #    -1, #    -1
nop.i  #     1, }    -1
slt.i  #     1, #     1
spl.i  @    -1, {    -1
mul.ba #     1, {     0
jmn.i  @     1, #     1
spl.b  *     0, *     0
spl.ab {    -1, *     1
jmn.i  *     1, *     1
spl.i  #     0, {     0
div.i  #     1, #     1
jmn.b  #    -1, >     1
mov.ba #     1, #     1
jmp.f  #     1, <     0
mov.ab #    -1, #    -1
mul.i  {     1, #     1
mul.f  #     0, >     0
djn.x  *     1, *     0
djn.i  #    -1, #     0
add.b  #    -1, #     1
sub.i  #     1, #    -1
mov.ba <     0, <     1
jmz.i  @     0, #    -1
djn.ba }    -1, #    -1
div.i  <    -1, #     0
spl.i  #     1, #    -1
jmn.i  }    -1, #     1
mov.x  #    -1, #     0
mov.i  #    -1, #     1
mov.ab #    -1, #     0
nop.i  #    -1, #     0
cmp.a  #     1, #     1
seq.ba <    -1, #     0
mul.i  #     1, #     1
jmn.i  }     1, }     1
mov.b  *     1, #    -1
div.i  {     1, @     1
jmn.a  *    -1, }     1
div.b  *     1, #     1
end   0
