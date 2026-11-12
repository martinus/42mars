;redcode
;assert 1
;name rdrc: Banshee Complaint
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   An evolving population playing KOTH.
;strategy -   Configured for the Tiny hill.
; evolved oneshot. Attacks with clear at one end 
; and djn at the other
sub.f  #   -34, $     1
sne.x  $   130, *  -136
djn.f  $    -2, <   110
spl.ba #   -12, {    29
mov.i  @  -201, {    -3
mov.i  <  -361, >    -2
mov.i  }    -1, >    -3
djn.f  $    -2, <    -6
end   1
