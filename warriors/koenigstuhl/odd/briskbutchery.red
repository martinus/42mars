;redcode-94nop
;assert CORESIZE == 8000
;name rdrc: Brisk Butchery
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   Configured for the 2016 Easter Contest.
;strategy -   multiwarrior, processes 64.
; DJN attack pairs of locations w/ step 15. 
; Includes a slow core-clear.
; Eventually includes a slow djn-stream
; Winds up as just a djn-stream
; Might start splitting blindly into core, depending on the opponent.
spl.ba $    -3, }     0
mov.f  $    -3, $    16
jmp.f  $    10, >     0
add.i  }    -2, >    -3
sub.ab $     1, <     9
djn.f  #     1, {     0
spl.ba $     0, @     9 ; self split
mov.i  @  -421, <    -2 ; core-clear
add.ab #    15, $     1 ; step size 15
djn.a  $    -1, {     2 ; djn-attack w/ step 15
djn.x  #    -2, {     0 ; fall through to djn-stream
spl.a  #     0, $     0 ; might fall through to 
jmp.ba >     7, $ -3986 ; jumping blindly into core
end   6
