;redcode verbose
;assert 1
;name Convolution Chromatograph
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   An evolving population playing KOTH.
;strategy -   For a contest where only "-1", "0", and "+1" are allowed
mod.ba {    -1, #    -1
sub.i  $     1, $     0
mod.i  #     1, *     0
nop.i  }     0, #     0
mod.b  #    -1, }    -1
spl.i  @    -1, #     0
slt.i  @    -1, #     0
spl.i  }     0, {    -1
jmp.f  }     0, #     0
jmp.i  }     0, $     0
sne.ab >     1, $     1
add.ab #    -1, {     1
sub.i  <     0, #    -1
spl.f  #     1, >    -1
mov.ab #    -1, #    -1
mov.i  }    -1, }     0
end   4

